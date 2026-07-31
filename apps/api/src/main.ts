// Must be the very first import: some decorators (e.g. @Throttle on
// AuthController) read rate-limit values from process.env at module-load
// time, which happens before Nest's own ConfigModule has a chance to run.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOriginValidator, parseAllowedOrigins } from './common/utils/cors-origins.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  const allowedOrigins = parseAllowedOrigins(process.env.DASHBOARD_BASE_URL, 'http://localhost:3000');
  app.enableCors({
    origin: corsOriginValidator(allowedOrigins),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3001;
  // Explicit 0.0.0.0 bind: some container platforms (Railway included) proxy
  // to the container over an interface that isn't reached by Node's default
  // listen() binding, which otherwise looks like the app never came up.
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);
}

bootstrap();
