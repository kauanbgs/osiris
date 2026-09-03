import { Route, Routes } from 'react-router-dom';
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Home from "./pages/Home";
import Arquivos from "./pages/Arquivos";
import Workflow from "./pages/Workflow";
import DefaultLayout from "./layouts/DefaultLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route element={<DefaultLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/arquivos" element={<Arquivos />} />
        <Route path="/workflow" element={<Workflow />} />
      </Route>
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
