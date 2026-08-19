import { apiRequest } from "./client";

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

type AdminLoginInput = {
    email: string;
    password: string;
};

export async function getAdminSession() {
    return apiRequest<AdminSession>(
        "/admin/me"
    );
}

export async function loginAdmin(
    input: AdminLoginInput
) {
    await apiRequest(
        "/login",
        {
            method: "POST",
            body: JSON.stringify(input)
        }
    );

    return getAdminSession();
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