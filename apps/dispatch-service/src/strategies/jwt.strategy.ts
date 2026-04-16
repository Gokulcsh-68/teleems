import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const publicKey = fs.readFileSync(path.join(process.cwd(), 'secrets', 'jwtRS256.key.pub'), 'utf8');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    // Stateless validation for decoupled microservices
    // Signature & expiration are automatically checked by passport-jwt
    return { userId: payload.sub, roles: payload.roles || [payload.role] };
  }
}
