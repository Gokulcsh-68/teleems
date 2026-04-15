import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRevocation1776159089994 implements MigrationInterface {
    name = 'AddUserRevocation1776159089994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."rtvs_records_timestamp_idx"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "tokensRevokedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "tokensRevokedAt"`);
        await queryRunner.query(`CREATE INDEX "rtvs_records_timestamp_idx" ON "rtvs_records" ("timestamp") `);
    }

}
