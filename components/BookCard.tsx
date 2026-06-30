import React from "react";
import Link from "next/link";
import BookCover from "@/components/BookCover";
import { cn } from "@/lib/utils";
import Image from "next/image";
import dayjs from "dayjs";

const BookCard = ({
  id,
  title,
  genre,
  coverColor,
  coverUrl,
  isLoanedBook = false,
  dueDate,
}: Book) => {
  const daysLeft = dueDate ? dayjs(dueDate).diff(dayjs(), "day") : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  return (
    <li className={cn(isLoanedBook && "xs:w-52 w-full")}>
      <Link
        href={`/books/${id}`}
        className={cn(isLoanedBook && "w-full flex flex-col items-center")}
      >
        <BookCover coverColor={coverColor} coverImage={coverUrl} />

        <div className={cn("mt-4", !isLoanedBook && "xs:max-w-40 max-w-28")}>
          <p className="book-title">{title}</p>
          <p className="book-genre">{genre}</p>
        </div>

        {isLoanedBook && (
          <div className="mt-3 w-full">
            <div className="book-loaned">
              <Image
                src="/icons/calendar.svg"
                alt="calendar"
                width={18}
                height={18}
                className="object-contain"
              />
              <p className="text-light-100">
                {daysLeft === null
                  ? "Due date unavailable"
                  : isOverdue
                    ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`
                    : daysLeft === 0
                      ? "Due today"
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to return`}
              </p>
            </div>
          </div>
        )}
      </Link>
    </li>
  );
};

export default BookCard;
