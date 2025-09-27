import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Review } from './review.entity';

@Entity('review_comments')
export class ReviewComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  reviewId!: string;

  @ManyToOne(() => Review, (review) => review.comments)
  @JoinColumn({ name: 'reviewId' })
  review!: Review;

  @Column()
  filePath!: string;

  @Column({ nullable: true })
  lineNumber?: number;

  @Column({
    type: 'enum',
    enum: ['bug', 'security', 'performance', 'style', 'best-practice'],
  })
  issueType!: string;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
  })
  severity!: string;

  @Column('text')
  message!: string;

  @Column('text')
  suggestion!: string;

  @Column({ nullable: true })
  githubCommentId?: number;

  @CreateDateColumn()
  createdAt!: Date;
}