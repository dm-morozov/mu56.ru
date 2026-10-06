"""Linux WSGI service; never expose this listener outside the host."""
bind = "127.0.0.1:8000"
workers = 2
worker_class = "gthread"
threads = 2
timeout = 30
graceful_timeout = 30
keepalive = 5
forwarded_allow_ips = "127.0.0.1"
secure_scheme_headers = {"X-FORWARDED-PROTO": "https"}
accesslog = None  # Nginx owns access logs, excluding query strings and form data.
errorlog = "-"
capture_output = True
control_socket_disable = True  # systemd manages processes; no writable HOME/control API needed.
max_requests = 1000
max_requests_jitter = 100
