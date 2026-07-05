import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Customer } from "../types";

const STAGES = ["new_lead", "contacted", "quote_sent", "negotiating"];

export function Pipeline() {
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", "pipeline"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const byStage = STAGES.map((stage) => ({
    stage,
    items: customers.filter((c) => c.status === stage),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Sales Pipeline</h1>
        <p className="text-brown/60 text-sm">Leads in progress, grouped by stage. Deal-value tracking arrives in a future update.</p>
      </div>
      {isLoading ? (
        <p className="text-brown/60">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {byStage.map(({ stage, items }) => (
            <div key={stage} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-brown capitalize">{stage.replace("_", " ")}</h3>
                <span className="badge badge-neutral">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs text-brown/40">No data yet</p>}
                {items.map((c) => (
                  <Link
                    key={c.id}
                    to={`/customers/${c.id}`}
                    className="block rounded-lg border border-black/5 bg-cream/50 px-3 py-2 text-sm hover:border-gold/40"
                  >
                    <p className="font-medium text-ink">{c.businessName}</p>
                    <p className="text-xs text-brown/50">{c.customerType.replace("_", " ")}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
