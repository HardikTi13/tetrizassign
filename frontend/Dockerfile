FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Run Vite dev server with host listening
CMD ["npm", "run", "dev"]
