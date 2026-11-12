import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((request) => {
  const token = sessionStorage.getItem("balancevault-token");
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("balancevault-token");
      window.dispatchEvent(new Event("balancevault:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === "ECONNABORTED") {
    return "The BalanceVault server took too long to respond. Please try again.";
  }
  if (!error.response) {
    return "Unable to reach the BalanceVault server. Check your connection and try again.";
  }
  return "BalanceVault could not complete this request. Please try again.";
}

export default api;
