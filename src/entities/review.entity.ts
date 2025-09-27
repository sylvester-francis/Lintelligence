import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ReviewComment } from './review-comment.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  owner!: string;

  @Column()
  repo!: string;

  @Column()
  pullNumber!: number;

  @Column()
  commitSha!: string;

  @Column('text')
  summary!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  })
  status!: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => ReviewComment, (comment) => comment.review)
  comments!: ReviewComment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}