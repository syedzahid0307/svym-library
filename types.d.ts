interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  rating: number;
  totalCopies: number;
  availableCopies: number;
  description: string;
  coverColor: string;
  coverUrl: string;
  videoUrl: string;
  summary: string;
  isbn?: string | null;
  libraryBarcode: string;
  createdAt: Date | null;
  // Set when this Book is being rendered inside a "my borrowed books"
  // list (see my-profile/page.tsx) rather than the general catalog -
  // BookCard uses this to switch to the loan-receipt layout and show
  // the real due date below instead of the plain catalog card.
  isLoanedBook?: boolean;
  borrowRecordId?: string;
  dueDate?: string;
}

interface AuthCredentials {
  fullName: string;
  email: string;
  password: string;
  staffId: number;
}

interface BookParams {
  title: string;
  author: string;
  genre: string;
  rating: number;
  coverUrl: string;
  coverColor: string;
  description: string;
  totalCopies: number;
  videoUrl: string;
  summary: string;
  isbn?: string;
}

interface BorrowBookParams {
  bookId: string;
  userId: string;
}

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  staffId: number;
  memberType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | null;
  role: "USER" | "STAFF" | "ADMIN" | null;
  lastActivityDate?: string | null;
  createdAt: Date | string | null;
}

interface BorrowRecordAdminView {
  id: string;
  borrowDate: Date | string;
  dueDate: string;
  returnDate: string | null;
  status: "BORROWED" | "RETURNED";
  bookId: string;
  bookTitle: string;
  bookCoverColor: string;
  libraryBarcode: string;
  userId: string;
  userFullName: string;
  userStaffId: number;
  isOverdue: boolean;
}
