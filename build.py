import os
import shutil

def build():
    # Define directories
    src_dir = "static"
    dist_dir = "dist"
    dist_static_dir = os.path.join(dist_dir, "static")

    print("[BUILD] Starting build process...")

    # Clean existing dist directory
    if os.path.exists(dist_dir):
        print(f"[BUILD] Cleaning existing {dist_dir} directory...")
        shutil.rmtree(dist_dir)

    # Create directories
    os.makedirs(dist_static_dir, exist_ok=True)

    # Copy files
    print("[BUILD] Copying static files...")
    shutil.copy(os.path.join(src_dir, "index.html"), os.path.join(dist_dir, "index.html"))
    shutil.copy(os.path.join(src_dir, "style.css"), os.path.join(dist_static_dir, "style.css"))
    shutil.copy(os.path.join(src_dir, "app.js"), os.path.join(dist_static_dir, "app.js"))

    # Generate _redirects if BACKEND_API_URL is set in environment
    backend_url = os.environ.get("BACKEND_API_URL")
    if backend_url:
        # Strip trailing slash if present
        if backend_url.endswith("/"):
            backend_url = backend_url[:-1]
        
        redirects_content = f"/api/*  {backend_url}/api/:splat  200\n"
        with open(os.path.join(dist_dir, "_redirects"), "w") as f:
            f.write(redirects_content)
        print(f"[BUILD] Created _redirects routing to: {backend_url}")
    else:
        print("[BUILD] BACKEND_API_URL environment variable is not set. No _redirects file created.")
        print("[BUILD] (If deploying to Netlify, set BACKEND_API_URL in Netlify settings to route /api/* to your backend)")

    print("[BUILD] Build complete successfully!")

if __name__ == "__main__":
    build()
