import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

// Function to determine the API base URL based on current domain
function getApiBaseUrl(): string {
	// If explicitly set via environment variable, use that
	if (import.meta.env.VITE_API_URL) {
		console.log('Using VITE_API_URL:', import.meta.env.VITE_API_URL);
		return import.meta.env.VITE_API_URL;
	}

	// Otherwise, construct URL based on current location
	if (typeof window !== 'undefined') {
		const { protocol, hostname } = window.location;
		
		// If running on localhost, use localhost:3001
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			const url = `${protocol}//localhost:3001`;
			console.log('Constructed API URL for localhost:', url);
			return url;
		}
		
		// For other domains (like Tailscale), use the same hostname but port 3001
		const url = `${protocol}//${hostname}:3001`;
		console.log('Constructed API URL for external domain:', url, 'from hostname:', hostname);
		return url;
	}
	
	// Fallback for server-side rendering or when window is not available
	console.log('Using fallback API URL: http://localhost:3001');
	return "http://localhost:3001";
}

class ApiService {
	private api: AxiosInstance;

	constructor() {
		this.api = axios.create({
			baseURL: getApiBaseUrl(),
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response = await this.api.get(url, config);
		return response.data;
	}

	async post<T>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response = await this.api.post(url, data, config);
		return response.data;
	}

	async put<T>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response = await this.api.put(url, data, config);
		return response.data;
	}

	async patch<T>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response = await this.api.patch(url, data, config);
		return response.data;
	}

	async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response = await this.api.delete(url, config);
		return response.data;
	}

	// Repository-specific endpoints
	async listRepositories() {
		return this.get<{
			repositories: Array<{
				folderName: string;
				path: string;
				isGitRepository: boolean;
			}>;
			total: number;
			githubReposDirectory: string;
		}>("/api/claude-code/repositories");
	}
}

export const apiService = new ApiService();
