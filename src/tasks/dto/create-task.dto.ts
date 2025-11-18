import { IsNotEmpty } from "class-validator";

export class CreateTaskDto {
    //using the validator class to validate the fields, the class will also handle errors for us
    @IsNotEmpty()
    title: string;

    @IsNotEmpty()
    description: string;
}