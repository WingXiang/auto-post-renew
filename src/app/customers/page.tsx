"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Spinner,
  Badge,
} from "@/components/ui";
import type { PotentialCustomer } from "@/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<PotentialCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifying, setIdentifying] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchCustomers = useCallback(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleIdentify = async () => {
    setIdentifying(true);
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "identify" }),
      });
      setTimeout(fetchCustomers, 5000);
    } finally {
      setIdentifying(false);
    }
  };

  const handleUpdateStatus = async (
    customerId: string,
    status: PotentialCustomer["status"]
  ) => {
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_status",
        customer_id: customerId,
        status,
      }),
    });
    setCustomers((prev) =>
      prev.map((c) =>
        c.customer_id === customerId ? { ...c, status } : c
      )
    );
  };

  const filtered =
    filter === "all"
      ? customers
      : customers.filter((c) => c.status === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="潛在客戶"
        description="AI 識別的高意向互動者與跟進建議"
        actions={
          <Button onClick={handleIdentify} disabled={identifying}>
            {identifying ? "識別中..." : "AI 識別客戶"}
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        {["all", "new", "contacted", "converted", "dismissed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === s
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s === "all"
              ? "全部"
              : s === "new"
              ? "新發現"
              : s === "contacted"
              ? "已聯繫"
              : s === "converted"
              ? "已轉換"
              : "已忽略"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="尚無潛在客戶"
          description="AI 會自動識別貼文留言中的高意向互動者"
          action={
            <Button onClick={handleIdentify} disabled={identifying}>
              AI 識別客戶
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((customer) => (
            <Card key={customer.customer_id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">
                      {customer.display_name}
                    </h3>
                    <StatusBadge status={customer.status} />
                    <Badge color="blue">{customer.interaction_type}</Badge>
                  </div>
                  <p className="mb-2 text-sm text-gray-600">
                    {customer.interaction_content}
                  </p>
                  {customer.suggested_action && (
                    <div className="rounded-md bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-800">
                        AI 建議動作
                      </p>
                      <p className="text-sm text-blue-700">
                        {customer.suggested_action}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    識別時間:{" "}
                    {customer.identified_at
                      ? new Date(customer.identified_at).toLocaleString("zh-TW")
                      : ""}
                  </p>
                </div>
                <div className="ml-4 flex flex-col gap-1">
                  {customer.status === "new" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleUpdateStatus(
                            customer.customer_id,
                            "contacted"
                          )
                        }
                      >
                        標記已聯繫
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleUpdateStatus(
                            customer.customer_id,
                            "dismissed"
                          )
                        }
                      >
                        忽略
                      </Button>
                    </>
                  )}
                  {customer.status === "contacted" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleUpdateStatus(
                          customer.customer_id,
                          "converted"
                        )
                      }
                    >
                      標記已轉換
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
