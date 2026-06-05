import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let loadingPromise = null;

const MODEL_URL = `${import.meta.env.BASE_URL}models`;

/**
 * Load face detection & recognition models (once)
 */
export async function loadModels() {
    if (modelsLoaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            console.log('[FaceService] Loading face recognition models...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            modelsLoaded = true;
            console.log('[FaceService] Models loaded successfully');
        } catch (err) {
            console.error('[FaceService] Failed to load models:', err);
            loadingPromise = null;
            throw err;
        }
    })();

    return loadingPromise;
}

/**
 * Detect a face in an image and return its 128-dim descriptor
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} input
 * @returns {Float32Array|null} 128-dimensional face descriptor, or null if no face found
 */
export async function getFaceDescriptor(input) {
    if (!modelsLoaded) await loadModels();

    const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        console.warn('[FaceService] No face detected in image');
        return null;
    }

    console.log('[FaceService] Face detected, confidence:', detection.detection.score.toFixed(2));
    return detection.descriptor;
}

/**
 * Get face descriptor from a base64 image URL
 * @param {string} dataUrl - base64 image string
 * @returns {Float32Array|null}
 */
export async function getDescriptorFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            try {
                const descriptor = await getFaceDescriptor(img);
                resolve(descriptor);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });
}

/**
 * Compare two face descriptors and return the euclidean distance
 * Lower = more similar. Typical threshold: 0.6
 * @param {Float32Array|number[]} desc1
 * @param {Float32Array|number[]} desc2
 * @returns {number} euclidean distance (0 = identical, >0.6 = different person)
 */
export function compareFaces(desc1, desc2) {
    if (!desc1 || !desc2) return 999;

    const a = desc1 instanceof Float32Array ? desc1 : new Float32Array(desc1);
    const b = desc2 instanceof Float32Array ? desc2 : new Float32Array(desc2);

    return faceapi.euclideanDistance(a, b);
}

/**
 * Convert descriptor to a JSON-serializable array
 */
export function descriptorToArray(descriptor) {
    if (!descriptor) return null;
    return Array.from(descriptor);
}

/**
 * Check if models are loaded
 */
export function isReady() {
    return modelsLoaded;
}

/**
 * Calculate Mouth Aspect Ratio (MAR) to detect opening
 */
function calculateMAR(landmarks) {
    const mouth = landmarks.getMouth();
    // Vertical distances
    const v1 = Math.sqrt(Math.pow(mouth[14].x - mouth[18].x, 2) + Math.pow(mouth[14].y - mouth[18].y, 2));
    const v2 = Math.sqrt(Math.pow(mouth[15].x - mouth[17].x, 2) + Math.pow(mouth[15].y - mouth[17].y, 2));
    // Horizontal distance
    const h = Math.sqrt(Math.pow(mouth[12].x - mouth[16].x, 2) + Math.pow(mouth[12].y - mouth[16].y, 2));
    return (v1 + v2) / (2.0 * h);
}

/**
 * Estimate Head Pose (Yaw and Pitch) from landmarks
 */
function calculatePose(landmarks) {
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Yaw (Left/Right Turn): Distance from nose bridge to jaw edges
    const noseBridge = nose[0];
    const leftJaw = jaw[0];
    const rightJaw = jaw[16];

    const distToLeft = Math.abs(noseBridge.x - leftJaw.x);
    const distToRight = Math.abs(noseBridge.x - rightJaw.x);
    const yaw = (distToLeft - distToRight) / (distToLeft + distToRight); // -1 to 1

    // Pitch (Up/Down): Distance from nose tip to jaw bottom center
    const noseTip = nose[6];
    const jawBottom = jaw[8];
    const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
    const pitch = (noseTip.y - eyeCenterY) / (jawBottom.y - eyeCenterY); // Ratio

    return { yaw, pitch };
}

/**
 * Detect facial landmarks and check for liveness factors (Pose + Expression)
 */
export async function detectLiveness(input) {
    if (!modelsLoaded) await loadModels();

    const detection = await faceapi
        .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
        .withFaceLandmarks();

    if (!detection) return { face: false };

    const landmarks = detection.landmarks;
    const mar = calculateMAR(landmarks);
    const { yaw, pitch } = calculatePose(landmarks);

    return {
        face: true,
        mar,
        yaw,
        pitch,
        box: detection.detection.box
    };
}

export default {
    loadModels,
    getFaceDescriptor,
    getDescriptorFromDataUrl,
    compareFaces,
    descriptorToArray,
    detectLiveness,
    isReady,
};
