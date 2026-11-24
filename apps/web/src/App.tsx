import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { AttemptResult } from "./pages/AttemptResult";
import { CourseDetail } from "./pages/CourseDetail";
import { Courses } from "./pages/Courses";
import { DocumentEdit } from "./pages/DocumentEdit";
import { DocumentView } from "./pages/DocumentView";
import { FileView } from "./pages/FileView";
import { Login } from "./pages/Login";
import { QuizEdit } from "./pages/QuizEdit";
import { QuizTake } from "./pages/QuizTake";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      {/* Layout 配下はログイン必須 */}
      <Route element={<Layout />}>
        <Route index element={<Courses />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="documents/:documentId" element={<DocumentView />} />
        <Route path="documents/:documentId/edit" element={<DocumentEdit />} />
        <Route path="files/:fileId" element={<FileView />} />
        <Route path="quizzes/:quizId" element={<QuizTake />} />
        <Route path="quizzes/:quizId/edit" element={<QuizEdit />} />
        <Route path="attempts/:attemptId" element={<AttemptResult />} />
      </Route>
    </Routes>
  );
}
