FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

# Define the command to run the application
CMD ["npm", "run", "serve"]
