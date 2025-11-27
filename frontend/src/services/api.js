import axios from "axios";
import localApi from "./localApi.js";

const base = import.meta.env.VITE_API_BASE || "/api";
const localMode = import.meta.env.VITE_LOCAL_MODE === "true" || (typeof window !== "undefined" && window.location.hostname.endsWith("github.io") && !import.meta.env.VITE_API_BASE);

let api;
if (localMode) {
  api = localApi;
} else {
  api = axios.create({ baseURL: base });
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

export default api;
