import { Route, Routes } from 'react-router-dom';
import ServiceDesk from './pages/ServiceDesk';
import RoleManagementPage from './pages/RoleManagementPage/RoleManagementPage';
import NotFound from './pages/NotFound/NotFound';
import InventoryManagementPage from './pages/InventoryManagementPage/InventoryManagementPage';
import CardItemManagementPage from './pages/CardItemManagementPage/CardItemManagementPage';
import CardDataAnalyticsPage from './pages/CardDataAnalyticsPage/CardDataAnalyticsPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route index element={<ServiceDesk />} />
      <Route path="staff-permissions" element={<RoleManagementPage />} />
      <Route path="inventory" element={<InventoryManagementPage />} />
      <Route path="card-items" element={<CardItemManagementPage />} />
      <Route path="card-data-analytics" element={<CardDataAnalyticsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
