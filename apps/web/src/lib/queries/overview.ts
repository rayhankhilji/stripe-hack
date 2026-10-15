"use client";
import { useQuery } from "@tanstack/react-query";
import type { OverviewDTO } from "@ghost/shared";
import { api } from "../api";
import { keys } from "./keys";

export function useOverview() {
  return useQuery({ queryKey: keys.overview, queryFn: () => api<OverviewDTO>("/api/v1/overview") });
}
