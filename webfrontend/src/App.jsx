import { Route, Routes } from 'react-router-dom';
import TitleBar from "./components/TitleBar";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Home from "./pages/Home";
import Arquivos from "./pages/Arquivos";
import Workflow from "./pages/Workflow";
import Modelos from "./pages/Modelos";
import DefaultLayout from "./layouts/DefaultLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route element={<ProtectedRoute />}/>
      <Route element={<DefaultLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/arquivos" element={<Arquivos />} />
        <Route path="/workflow" element={<Workflow />} />
      </Route>
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
