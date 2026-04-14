import { FaHome, FaFileAlt, FaUser, FaClock, FaSignOutAlt, FaCalendarAlt, FaSlidersH, FaUmbrellaBeach } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { to: '/dashboard',       icon: <FaHome />,           label: 'Home',             color: 'text-purple-600' },
    { to: '/Addstudent',      icon: <FaUser />,           label: 'Add Students',     color: 'text-blue-600'   },
    { to: '/Enrolled',        icon: <FaFileAlt />,        label: 'Enrolled',         color: 'text-red-500'    },
    { to: '/Period',          icon: <FaClock />,          label: 'Period Wise',      color: 'text-green-500'  },
    { to: '/timetable',       icon: <FaCalendarAlt />,    label: 'Timetable',        color: 'text-amber-500'  },
    { to: '/period-settings', icon: <FaSlidersH />,       label: 'Period Settings',  color: 'text-indigo-500' },
    { to: '/holidays',        icon: <FaUmbrellaBeach />,  label: 'Holidays',         color: 'text-orange-500' },
  ];

  return (
    <div className="w-full lg:w-64 bg-white shadow-xl rounded-2xl p-4 flex flex-col justify-between min-h-[90vh]">
      <div>
        <div className="flex items-center justify-center mb-8 mt-2">
          <div className="w-10 h-10 rounded-xl bg-[#1E2A78] flex items-center justify-center mr-2">
            <span className="text-white font-bold text-sm">GN</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">Admin Panel</h2>
        </div>

        <div className="flex flex-col gap-1.5">
          {navItems.map(({ to, icon, label, color }) => {
            const isActive = location.pathname === to;
            return (
              <Link to={to} key={to}>
                <button className={`flex items-center space-x-3 w-full text-left py-2.5 px-4 rounded-xl transition-all duration-200
                    ${isActive ? 'bg-[#1E2A78] text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <span className={isActive ? 'text-white' : color}>{icon}</span>
                  <span className="font-medium text-sm">{label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <Link to="/student-register">
          <button className="w-full py-2 rounded-xl border border-[#1E2A78] text-[#1E2A78] text-sm font-medium hover:bg-blue-50 transition flex items-center justify-center gap-2">
            <FaUser size={12} /> Student Portal
          </button>
        </Link>
        <Link to="/signin">
          <button className="w-full py-2.5 rounded-xl bg-[#1E2A78] text-white shadow-md flex items-center justify-center space-x-2 hover:bg-[#16239D] transition-all duration-300">
            <FaSignOutAlt />
            <span className="font-medium text-sm">Log Out</span>
          </button>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;