import {
    API_BASE_URL,
    apiRequest
} from "./client";

export type AdminSession = {
    user: {
        id: string;
        name: string;
        email: string;
    };
    session: {
        id: string;
    };
};

export async function getAdminSession() {
    return apiRequest<AdminSession>(
        "/admin/me"
    );
}

export function getAdminLoginUrl() {
    const returnTo =
        window.location.origin;

    return (
        `${API_BASE_URL}/login` +
        `?returnTo=${encodeURIComponent(returnTo)}`
    );
}

export async function logoutAdmin() {
    return apiRequest<{
        success: boolean;
    }>(
        "/logout/sso",
        {
            method: "POST"
        }
    );
}