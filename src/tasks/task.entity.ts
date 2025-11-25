import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { TaskStatus } from './task-status.enum';
import { User } from '../auth/user.entity';
import { Exclude } from 'class-transformer';


@Entity()
export class Task {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column()
    description: string;

    @Column({
        type: 'simple-enum',
        enum: TaskStatus,
        default: TaskStatus.OPEN,
    })
    status: TaskStatus;

    @ManyToOne(() => User, user => user.tasks, { eager: false, onDelete: 'CASCADE' })
    @Exclude({ toPlainOnly: true })
    user: User;

    @RelationId((task: Task) => task.user)
    userId: string;
}