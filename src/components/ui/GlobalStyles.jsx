import React from 'react';

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --bg: #0a0e1a;
      --surface: #111827;
      --card: #1e293b;
      --border: #334155;
      --primary: #3b82f6;
      --primary-light: #60a5fa;
      --secondary: #06b6d4;
      --accent: #8b5cf6;
      --green: #10b981;
      --red: #ef4444;
      --teal: #06b6d4;
      --cyan: #3b82f6;
      --gold: #f59e0b;
      --purple: #8b5cf6;
      --text-main: #f1f5f9;
      --text-dim: #94a3b8;
      --glass: rgba(17, 24, 39, 0.82);
      --glass-border: rgba(59, 130, 246, 0.15);
      --glass-glow: rgba(59, 130, 246, 0.08);
    }

    body.light-theme {
      --bg: #f0f4f8;
      --surface: #ffffff;
      --card: #f8fafc;
      --border: #e2e8f0;
      --primary: #2563eb;
      --primary-light: #3b82f6;
      --secondary: #0891b2;
      --accent: #7c3aed;
      --green: #059669;
      --red: #dc2626;
      --teal: #0891b2;
      --cyan: #2563eb;
      --gold: #d97706;
      --purple: #7c3aed;
      --text-main: #0f172a;
      --text-dim: #64748b;
      --glass: rgba(255, 255, 255, 0.92);
      --glass-border: rgba(37, 99, 235, 0.12);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background-color: transparent;
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--primary); }

    /* Animations */
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
      70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.6; box-shadow: 0 0 8px var(--primary); }
      50% { opacity: 1; box-shadow: 0 0 16px var(--primary); }
    }
    @keyframes progressFill {
      from { width: 0; }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scanline {
      0% { top: -100%; opacity: 0; }
      50% { opacity: 0.5; }
      100% { top: 200%; opacity: 0; }
    }
    @keyframes dottedFade {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.8; }
    }
    
    .scan-zone {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      height: 420px;
      border: 2px dashed var(--red);
      border-radius: 160px / 210px;
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      opacity: 0.6;
    }
    
    .scan-zone.active {
      border: 3px dashed var(--primary);
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
      opacity: 1;
    }

    .scan-zone.near {
      border: 3px dashed var(--green) !important;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
      opacity: 1;
    }

    .scan-zone.face-detected {
      border: 3px solid var(--green) !important;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.4) !important;
      animation: glowPulse 1.5s infinite alternate !important;
      opacity: 1;
    }
    
    .scan-zone.success {
      border: 3px solid var(--green);
      border-radius: 160px / 210px;
      box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
      opacity: 1;
    }

    .font-audio { font-family: 'Inter', sans-serif; font-weight: 700; }
    .font-heading { font-family: 'Inter', sans-serif; font-weight: 700; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .font-code { font-family: 'JetBrains Mono', monospace; }
    
    .cyber-card {
      background: var(--glass);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      border: 1px solid var(--border);
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .cyber-card:hover {
      border-color: var(--glass-border);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--glass-border);
      transform: translateY(-2px);
    }

    /* react-big-calendar Theme Overrides */
    .rbc-calendar { color: var(--text-main); font-family: 'Inter', sans-serif; }
    .rbc-header { border-bottom: 1px solid var(--border) !important; padding: 8px; font-weight: 600; color: var(--primary); }
    .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid var(--border) !important; border-radius: 12px; overflow: hidden; }
    .rbc-day-bg, .rbc-month-row, .rbc-time-content, .rbc-timeslot-group, .rbc-day-slot .rbc-time-slot { border-color: rgba(51, 65, 85, 0.4) !important; }
    .rbc-off-range-bg { background-color: rgba(0, 0, 0, 0.15); }
    .rbc-today { background-color: rgba(59, 130, 246, 0.06); }
    .rbc-time-header { border-bottom: 1px solid var(--border) !important; }
    .rbc-time-header-content { border-left: 1px solid var(--border) !important; }
    .rbc-time-content { border-top: 1px solid var(--border) !important; }
    .rbc-day-slot .rbc-events-container { margin-right: 0; }
    .rbc-event { background-color: transparent !important; border: none !important; }
    .rbc-event:focus { outline: none; }
    .rbc-button-link { color: var(--text-main); font-weight: 600; }
    .rbc-toolbar button { color: var(--text-main); border: 1px solid var(--border) !important; background: var(--surface); transition: all 0.2s; border-radius: 8px; padding: 6px 14px; font-family: 'Inter', sans-serif; }
    .rbc-toolbar button:hover, .rbc-toolbar button:active, .rbc-toolbar button.rbc-active { background: rgba(59, 130, 246, 0.1) !important; color: var(--primary); border-color: var(--primary) !important; box-shadow: none !important; }
    .rbc-time-gutter .rbc-timeslot-group { border-bottom: none; }
    .rbc-label { color: var(--text-dim); }
    .rbc-toolbar-label { font-family: 'Inter', sans-serif; font-weight: 700; color: var(--primary); }
    .rbc-time-column .rbc-timeslot-group { border-bottom: 1px solid rgba(51, 65, 85, 0.4) !important; }
    .rbc-allday-cell { border-bottom: 1px solid var(--border) !important; display: none; }

    .btn-cyber {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid var(--primary);
      color: var(--primary);
      padding: 10px 20px;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 10px;
      position: relative;
      overflow: hidden;
      font-size: 0.82rem;
      letter-spacing: 0.5px;
    }
    .btn-cyber:hover {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
      transform: translateY(-1px);
    }
    .btn-cyber:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3); }
    .btn-cyber:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.5); transform: none; }

    .form-input {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 12px 14px;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      margin-bottom: 15px;
      border-radius: 10px;
      transition: all 0.25s ease;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      background: var(--card);
    }
    .form-input::placeholder {
      color: var(--text-dim);
      opacity: 0.6;
    }
    .form-label {
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      display: block;
      color: var(--text-dim);
      margin-bottom: 6px;
      font-size: 0.85rem;
    }

    .scan-overlay {
      display: none;
    }

    /* Stat cards */
    .stat-card {
      padding: 20px;
      text-align: center;
      border-radius: 12px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }
    .stat-card .stat-value {
      font-size: 2rem;
      font-weight: 800;
      font-family: 'Inter', sans-serif;
      line-height: 1.2;
    }
    .stat-card .stat-label {
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim);
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Subject tag pills */
    .subject-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      letter-spacing: 0.3px;
      transition: all 0.25s ease;
    }
    .subject-tag:hover {
      transform: scale(1.03);
    }

    /* Table styles */
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .data-table thead tr {
      background: rgba(59, 130, 246, 0.06);
    }
    .data-table th {
      padding: 12px 16px;
      text-align: left;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.75rem;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 12px 16px;
      font-size: 0.88rem;
      border-bottom: 1px solid rgba(51, 65, 85, 0.3);
    }
    .data-table tbody tr {
      transition: background 0.2s ease;
    }
    .data-table tbody tr:hover {
      background: rgba(59, 130, 246, 0.04);
    }

    /* Progress bar animation */
    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      animation: progressFill 1.2s ease-out;
      position: relative;
    }
    .progress-bar-fill::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
      background-size: 200% 100%;
      animation: shimmer 2.5s infinite;
    }

    /* User avatar ring */
    .avatar-ring {
      position: relative;
      display: inline-block;
    }
    .avatar-ring::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 2px solid var(--primary);
      opacity: 0.5;
    }

    /* Entrance animations for grid items */
    .animate-in {
      animation: fadeInUp 0.4s ease-out both;
    }
    @keyframes cyber-pulse {
      0% { box-shadow: 0 0 4px var(--green), inset 0 0 4px var(--green); border-color: var(--green); }
      50% { box-shadow: 0 0 16px var(--green), inset 0 0 8px var(--green); border-color: #fff; }
      100% { box-shadow: 0 0 4px var(--green), inset 0 0 4px var(--green); border-color: var(--green); }
    }

    @keyframes row-glow {
      0% { background: rgba(59, 130, 246, 0.3); box-shadow: inset 0 0 15px rgba(59, 130, 246, 0.3); }
      50% { background: rgba(59, 130, 246, 0.1); box-shadow: inset 0 0 8px rgba(59, 130, 246, 0.1); }
      100% { background: transparent; box-shadow: none; }
    }

    .glow-row {
      animation: row-glow 4s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      position: relative;
      z-index: 10;
    }

    .pulse-green {
      animation: cyber-pulse 4s ease-in-out forwards !important;
      border-width: 2px !important;
    }

    /* Responsive Layouts */
    .dashboard-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 24px;
    }
    
    .dashboard-layout-alt {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 24px;
    }

    .responsive-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .responsive-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }

    .responsive-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    @media (max-width: 768px) {
      .responsive-grid-4 {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 1024px) {
      .dashboard-layout, .dashboard-layout-alt {
        grid-template-columns: 1fr;
      }
      .responsive-grid-3 {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 768px) {
      .responsive-grid-2, .responsive-grid-3 {
        grid-template-columns: 1fr;
      }
    }
  `}</style>
);

export default GlobalStyles;
