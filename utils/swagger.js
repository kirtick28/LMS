import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LMS API',
      version: '1.0.0',
      description: 'Learning Management System API documentation'
    },
    servers: [
      {
        url: 'https://lms-vfdd.onrender.com',
        description: 'LMS Hosted Server'
      },
      {
        url: 'http://10.57.1.217:5000',
        description: 'IGNITE'
      },
      {
        url: 'http://localhost:5000',
        description: 'Local Server'
      },
      {
        url: 'http://172.16.140.112:5000',
        description: 'SECE-Wifi'
      },
      {
        url: 'http://172.17.29.240:5000',
        description: 'Wifi-D-Block'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
