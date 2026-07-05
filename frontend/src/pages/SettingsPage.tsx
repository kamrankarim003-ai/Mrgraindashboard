import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Settings } from "../types";
import { BusinessProfileTab } from "./settings/BusinessProfileTab";
import { FinanceTab } from "./settings/FinanceTab";
import { EmailTemplatesTab } from "./settings/EmailTemplatesTab";
import { ProductSettingsTab } from "./settings/ProductSettingsTab";
import { ImportDataTab } from "./settings/ImportDataTab";

const TABS = ["Business Profile", "Finance", "Users & Roles", "Email Integration", "Product Settings", "Import Data"] as const;
type Tab = (typeof TABS)[number];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Business Profile");
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Settings</h1>
      <div className="flex flex-wrap gap-2 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-gold text-brown font-medium" : "border-transparent text-brown/50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading || !settings ? (
        <p className="text-brown/60">Loading...</p>
      ) : (
        <>
          {tab === "Business Profile" && <BusinessProfileTab settings={settings} />}
          {tab === "Finance" && <FinanceTab settings={settings} />}
          {tab === "Users & Roles" && (
            <div className="card max-w-xl">
              <p className="text-sm text-brown/70">
                Manage user accounts and role assignments from the{" "}
                <Link to="/team" className="text-gold-dark hover:underline">Team</Link> page.
              </p>
            </div>
          )}
          {tab === "Email Integration" && <EmailTemplatesTab settings={settings} />}
          {tab === "Product Settings" && <ProductSettingsTab settings={settings} />}
          {tab === "Import Data" && <ImportDataTab />}
        </>
      )}
    </div>
  );
}
