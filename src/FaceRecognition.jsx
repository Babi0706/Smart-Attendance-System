import React, { useRef, useState } from "react";

const FaceRecognition = () => {
  const videoRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch (err) {
      alert("Camera access denied!");
      console.error(err);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>

      {!cameraOn && (
        <button
          onClick={startCamera}
          style={{
            padding: "10px 20px",
            background: "#06b6d4",
            border: "none",
            borderRadius: "8px",
            color: "white",
            cursor: "pointer",
          }}
        >
          Start Face Recognition
        </button>
      )}

      <video
        ref={videoRef}
        autoPlay
        style={{
          width: "400px",
          height: "300px",
          marginTop: "20px",
          borderRadius: "12px",
          border: "2px solid cyan",
        }}
      />
    </div>
  );
};

export default FaceRecognition;
