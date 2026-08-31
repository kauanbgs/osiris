import { Navigate, Route, Routes } from 'react-router-dom';
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cadastro />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="*" element={<Cadastro />} />
    </Routes>
  );
}
