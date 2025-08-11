import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

class ApiService {
	private api: AxiosInstance;

	constructor() {
		this.api = axios.create({
			baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
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
