const HTML_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
};

export function escapeHtml(
    value: string
): string {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            HTML_ESCAPE_MAP[character] ??
            character
    );
}

export function renderErrorPage(input: {
    applicationName: string;
    code: string;
    message: string;
    requestId: string;
}) {
    return `<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>${escapeHtml(input.applicationName)} - Error</title>
</head>
<body>
    <main>
        <h1>${escapeHtml(input.applicationName)}</h1>

        <h2>${escapeHtml(input.code)}</h2>

        <p>${escapeHtml(input.message)}</p>

        <p>
            Request ID:
            <code>${escapeHtml(input.requestId)}</code>
        </p>

        <p>
            <a href="/login">Coba login lagi</a>
        </p>
    </main>
</body>
</html>`;
}