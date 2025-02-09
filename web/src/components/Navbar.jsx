import { Link } from 'react-router-dom';

const navItems = [
  { path: '/', label: '词汇学习' },
  { path: '/history', label: '学习历史' }
];

function Navbar() {
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="container mx-auto">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost text-xl">今日学习</Link>
        </div>
        <div className="flex-none">
          <Link to="/history" className="btn btn-ghost">学习历史</Link>
        </div>
      </div>
    </div>
  );
}

export default Navbar;