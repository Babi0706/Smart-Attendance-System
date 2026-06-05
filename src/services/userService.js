import { supabase } from '../config/supabase';

/**
 * User Service for Supabase
 * Handles user data operations
 */

class UserService {
    /**
     * Get user by UID
     * @param {string} uid - User ID
     * @returns {Promise<Object>} User data
     */
    async getUserByUid(uid) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('uid', uid)
                .single();

            if (error) throw error;
            return { success: true, user: data };
        } catch (error) {
            console.error('Get user error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all users (admin only)
     * @param {string} role - Optional role filter
     * @returns {Promise<Array>} List of users
     */
    async getAllUsers(role = null) {
        try {
            let query = supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (role) {
                query = query.eq('role', role);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, users: data };
        } catch (error) {
            console.error('Get all users error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get students only
     * @returns {Promise<Array>} List of students
     */
    async getStudents() {
        return await this.getAllUsers('STUDENT');
    }

    /**
     * Get teachers only
     * @returns {Promise<Array>} List of teachers
     */
    async getTeachers() {
        return await this.getAllUsers('TEACHER');
    }

    /**
     * Update user data
     * @param {string} uid - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(uid, updates) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('uid', uid)
                .select()
                .single();

            if (error) throw error;
            return { success: true, user: data };
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete user
     * @param {string} uid - User ID
     * @returns {Promise<Object>} Result
     */
    async deleteUser(uid) {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('uid', uid);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Search users by name or UID
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Matching users
     */
    async searchUsers(searchTerm) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .or(`name.ilike.%${searchTerm}%,uid.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);

            if (error) throw error;
            return { success: true, users: data };
        } catch (error) {
            console.error('Search users error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new UserService();
