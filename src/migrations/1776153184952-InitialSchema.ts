import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776153184952 implements MigrationInterface {
    name = 'InitialSchema1776153184952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'CALLER', CONSTRAINT "UQ_8e1f623798118e629b46a9e6299" UNIQUE ("phone"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rtvs_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "vitals" json NOT NULL, CONSTRAINT "PK_c8c1ebe4cb39cbb2e2641778429" PRIMARY KEY ("id", "timestamp"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rtvs_records"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }

}
