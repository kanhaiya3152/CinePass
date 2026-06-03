import React from "react";
import { assets } from "../../assets/assets";
import { Link } from "react-router-dom";

const AdminNavbar = () => {
  return (
    <Link to='/'>
        <div className="flex items-center justify-between px-6 md:px-10 h-16 border-b border-gray-300/30">
      <div className="absolute left-5 flex items-center gap-0">
        <span>
          <img src={assets.favicon} alt="" className="w-8 h-10" />
        </span>
        <span>
          <img src={assets.lgo} alt="" className="w-36 h-auto" />
        </span>
      </div>
    </div>
    </Link>
  );
};

export default AdminNavbar;
