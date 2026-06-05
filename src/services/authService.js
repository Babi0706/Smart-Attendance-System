import { supabase } from '../config/supabase';

/**
 * Authentication Service for Supabase
 * Handles user signup, login, logout, and session management
 */

class AuthService {
    /**
     * Sign up a new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Created user data with UID
     */
    async signup(userData) {
        try {
            const { name, email, password, role, year, section, subject } = userData;
            // Support both 'dept' (from form) and 'department' field names
            const department = userData.department || userData.dept || null;

            // Generate UID based on role
            const uid = await this.generateUID(role);

            console.log('Attempting signup with:', { uid, name, email, role, department, year, section, subject });

            // Insert user into database
            const { data, error } = await supabase
                .from('users')
                .insert([
                    {
                        uid,
                        name,
                        email,
                        password: password,
                        role,
                        dept: department,
                        year: year || null,
                        section: section || null,
                        subject: subject || null,
                        phone: userData.phone || null,
                        face_data: userData.face_data || null,
                        face_descriptor: userData.face_descriptor || null,
                        rfid_tag: userData.rfid_tag || null
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }

            return { success: true, user: data, uid };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate unique UID based on role
     * @param {string} role - User role (STUDENT, TEACHER, ADMIN)
     * @returns {Promise<string>} Generated UID
     */
    async generateUID(role) {
        const prefix = role === 'STUDENT' ? 'STU' : role === 'TEACHER' ? 'TCH' : 'ADM';

        try {
            // Find the maximum UID with this prefix to avoid collisions after deletions
            const { data, error } = await supabase
                .from('users')
                .select('uid')
                .like('uid', `${prefix}%`)
                .order('uid', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Error fetching max UID:', error);
                // Fallback to a count-based approach if there's an error
                const { count } = await supabase
                    .from('users')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', role);
                return `${prefix}${((count || 0) + 1).toString().padStart(3, '0')}`;
            }

            let nextNumber = 1;
            if (data && data.length > 0) {
                const lastUid = data[0].uid;
                // Extract numeric part (e.g., 'STU005' -> 5)
                const lastNumber = parseInt(lastUid.substring(3));
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }

            return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
        } catch (error) {
            console.error('Generation error:', error);
            return `${prefix}001`;
        }
    }

    /**
     * Login user with UID and password
     * @param {string} uid - User ID
     * @param {string} password - User password
     * @param {string} expectedRole - Role selected in the UI
     * @returns {Promise<Object>} User data if successful
     */
    async login(uid, password, expectedRole) {
        // Handle Offline Login
        if (!navigator.onLine) {
            console.log('[AuthService] Offline login attempt...');
            const lastUser = JSON.parse(localStorage.getItem('lastKnownUser') || 'null');

            if (lastUser && lastUser.uid === uid && (lastUser.password_hash === password || lastUser.password === password)) {
                
                // Role verification (Offline)
                if (expectedRole && lastUser.role !== expectedRole) {
                    return { success: false, error: `Invalid role. This account is registered as ${lastUser.role}.` };
                }

                console.log('[AuthService] Offline login successful for:', uid);

                // Set as current session
                localStorage.setItem('currentUser', JSON.stringify(lastUser));
                localStorage.setItem('isAuthenticated', 'true');

                return { success: true, user: lastUser, offline: true };
            }

            return { success: false, error: 'Invalid credentials (Offline)' };
        }

        try {
            // Query user by UID
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('uid', uid)
                .single();

            if (error || !data) {
                return { success: false, error: 'Invalid credentials' };
            }

            // Role verification
            if (expectedRole && data.role !== expectedRole) {
                return { success: false, error: `Invalid role. This account is registered as ${data.role}.` };
            }

            // Check password (in production, use proper password hashing)
            const storedPassword = data.password || data.password_hash;
            if (storedPassword !== password) {
                return { success: false, error: 'Invalid credentials' };
            }

            // store last login time
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('uid', uid);

            // Store session in localStorage
            localStorage.setItem('currentUser', JSON.stringify(data));
            localStorage.setItem('isAuthenticated', 'true');

            // CACHE FOR OFFLINE LOGIN (Security Note: Strictly for demo offline capability)
            localStorage.setItem('lastKnownUser', JSON.stringify(data));

            return { success: true, user: data };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout current user
     */
    async logout() {
        try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isAuthenticated');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current logged-in user from session
     * @returns {Object|null} Current user or null
     */
    getCurrentUser() {
        try {
            const userJson = localStorage.getItem('currentUser');
            const isAuthenticated = localStorage.getItem('isAuthenticated');

            if (isAuthenticated === 'true' && userJson) {
                return JSON.parse(userJson);
            }
            return null;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return localStorage.getItem('isAuthenticated') === 'true';
    }

    /**
     * Update user profile
     * @param {string} uid - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated user data
     */
    async updateProfile(uid, updates) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('uid', uid)
                .select()
                .single();

            if (error) throw error;

            // Update localStorage if this is current user
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.uid === uid) {
                localStorage.setItem('currentUser', JSON.stringify(data));
            }

            return { success: true, user: data };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Link MetaMask wallet address to user
     * @param {string} uid - User ID
     * @param {string} walletAddress - Ethereum wallet address
     * @returns {Promise<Object>} Result
     */
    async linkWallet(uid, walletAddress) {
        return await this.updateProfile(uid, { wallet_address: walletAddress });
    }
}

export default new AuthService();
