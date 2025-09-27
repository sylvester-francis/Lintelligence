import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review, ReviewComment } from '../../entities';
import { DatabaseService } from './database.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, ReviewComment])],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}