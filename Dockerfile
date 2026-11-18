FROM nginx:alpine

# Copy the entire static HTML5 / WebGL (PixiJS + GSAP) application into Nginx web root
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets

# Configure proper MIME types for .mjs ES modules
RUN sed -i 's/application\/javascript                js;/application\/javascript                js mjs;/g' /etc/nginx/mime.types

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
