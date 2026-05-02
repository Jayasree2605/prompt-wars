# Pin to a specific Alpine 3.21 digest to avoid the 2 high CVEs present in
# the unversioned nginx:alpine tag (libssl / libcrypto in Alpine 3.20 and
# earlier).  Update this tag when a newer nginx stable is released.
FROM nginx:1.27.5-alpine3.21

# Drop root: run the worker process as the built-in nginx user.
# The master process still needs to bind port 8080 as root, but the
# worker that actually serves requests runs unprivileged.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx \
    /var/log/nginx /etc/nginx/conf.d \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid

COPY --chown=nginx:nginx index.html  /usr/share/nginx/html/index.html
COPY --chown=nginx:nginx config.js   /usr/share/nginx/html/config.js
COPY --chown=nginx:nginx src/        /usr/share/nginx/html/src/
COPY --chown=nginx:nginx styles/     /usr/share/nginx/html/styles/
COPY --chown=nginx:nginx tests/      /usr/share/nginx/html/tests/
COPY --chown=nginx:nginx nginx.conf  /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
