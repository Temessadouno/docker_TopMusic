FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
RUN npm install -g nodemon
COPY . .
EXPOSE 3000
CMD ["nodemon", "--watch", ".", "--ext", "js", "root.js"]