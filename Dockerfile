FROM nginx:1.27-alpine

COPY src/WordStudy.Web/ /usr/share/nginx/html/
EXPOSE 80
