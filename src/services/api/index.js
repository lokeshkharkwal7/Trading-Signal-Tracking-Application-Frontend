// src/services/api.js
import axios from "axios";

const API = axios.create({
  // baseURL: process.env.REACT_APP_API_BASE_URL,
  baseURL: "http://localhost:5000/api"
});

export const createSignal = (data) => API.post("/signals", data);
export const getSignals = () => API.get("/signals");
export const deleteSignal = (id) => API.delete(`/signals/${id}`);
export const getSymbolList = () => API.get("/symbol-list/partial");