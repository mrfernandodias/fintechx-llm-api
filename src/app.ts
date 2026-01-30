import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify from 'fastify'

import { askRoute } from './routes/ask.route.js'
import { demoRoute } from './routes/demo.route.js'
import { healthRoute } from './routes/health.route.js'
import { metaRoute } from './routes/meta.route.js'
import { sqlRoute } from './routes/sql.route.js'




export function buildApp() {
  const isProd = process.env.NODE_ENV === 'production'
  const app = Fastify({
    logger: isProd
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:standard', singleLine: true },
          },
        },
  })

  app.register(swagger, {
    openapi: {
      info: {
        title: 'FinTechX LLM-to-SQL API (MVP)',
        version: '0.1.0'
      }
    }
  })

  app.register(swaggerUi, {
    routePrefix: '/docs'
  })

  app.register(healthRoute)
  app.register(demoRoute)
  app.register(metaRoute)
  app.register(askRoute)
  app.register(sqlRoute)

  return app
}
