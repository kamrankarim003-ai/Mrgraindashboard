import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute, RequireModule } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { Customers } from "./pages/Customers";
import { CustomerDetail } from "./pages/CustomerDetail";
import { Pipeline } from "./pages/Pipeline";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { Invoices } from "./pages/Invoices";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { Payments } from "./pages/Payments";
import { Expenses } from "./pages/Expenses";
import { Inventory } from "./pages/Inventory";
import { ProductDetail } from "./pages/ProductDetail";
import { Tasks } from "./pages/Tasks";
import { Reports } from "./pages/Reports";
import { ReportDetail } from "./pages/ReportDetail";
import { Team } from "./pages/Team";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<RequireModule module="customers"><Customers /></RequireModule>} />
          <Route path="/customers/:id" element={<RequireModule module="customers"><CustomerDetail /></RequireModule>} />
          <Route path="/pipeline" element={<RequireModule module="customers"><Pipeline /></RequireModule>} />
          <Route path="/orders" element={<RequireModule module="orders"><Orders /></RequireModule>} />
          <Route path="/orders/:id" element={<RequireModule module="orders"><OrderDetail /></RequireModule>} />
          <Route path="/invoices" element={<RequireModule module="invoices"><Invoices /></RequireModule>} />
          <Route path="/invoices/:id" element={<RequireModule module="invoices"><InvoiceDetail /></RequireModule>} />
          <Route path="/payments" element={<RequireModule module="payments"><Payments /></RequireModule>} />
          <Route path="/expenses" element={<RequireModule module="expenses"><Expenses /></RequireModule>} />
          <Route path="/inventory" element={<RequireModule module="inventory"><Inventory /></RequireModule>} />
          <Route path="/inventory/:id" element={<RequireModule module="inventory"><ProductDetail /></RequireModule>} />
          <Route path="/tasks" element={<RequireModule module="tasks"><Tasks /></RequireModule>} />
          <Route path="/reports" element={<RequireModule module="reports"><Reports /></RequireModule>} />
          <Route path="/reports/:type" element={<RequireModule module="reports"><ReportDetail /></RequireModule>} />
          <Route path="/team" element={<RequireModule module="team"><Team /></RequireModule>} />
          <Route path="/settings" element={<RequireModule module="settings"><SettingsPage /></RequireModule>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
