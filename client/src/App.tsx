import { Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Board } from "./modules/retro/pages/Board";
import { CreateBoard } from "./modules/retro/pages/CreateBoard";
import { Dashboard } from "./modules/retro/pages/Dashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/retro" element={<Dashboard />} />
      <Route path="/retro/new" element={<CreateBoard />} />
      <Route path="/retro/b/:boardId" element={<Board />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
