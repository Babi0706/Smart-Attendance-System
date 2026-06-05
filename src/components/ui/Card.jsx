import React from 'react';
import { motion } from 'framer-motion';

export default function Card({ children, className = '', style = {} }) {
    return (
        <motion.div
            className={`cyber-card ${className}`}
            style={{ padding: '20px', ...style }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
            {children}
        </motion.div>
    );
}
