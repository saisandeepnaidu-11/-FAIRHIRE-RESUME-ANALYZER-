FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all application files
COPY . .

# Build the Vite frontend production assets
RUN npm run build

# Expose the application port
EXPOSE 3000

# Set production environment variable
ENV NODE_ENV=production
ENV PORT=3000

# Start the Node.js / Express server
CMD ["npm", "run", "start"]
