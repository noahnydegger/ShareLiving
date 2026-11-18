FROM nginx:stable-alpine
COPY retirement/default.conf /etc/nginx/conf.d/default.conf
COPY retirement/index.html /usr/share/nginx/html/index.html
