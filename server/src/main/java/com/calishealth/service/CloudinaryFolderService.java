package com.calishealth.service;

import com.calishealth.models.MediaFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The folders of the Cloudinary account that this app writes into.
 *
 * <p>Every media type gets its own folder, so an admin can tell the assets apart in the
 * Cloudinary Media Library without looking at the file names: the folder says what the file is.
 *
 * <pre>
 * calishealth/
 *   exercise-demos/                  video demo của bài tập hệ thống
 *   exercise-anatomy/                ảnh giải phẫu của bài tập hệ thống
 *   profile-avatars/                 ảnh đại diện của mọi tài khoản
 *   member-exercises/                media do thành viên tải lên
 *     exercise-demos/                video demo của bài tập cá nhân
 *     exercise-anatomy/              ảnh giải phẫu của bài tập cá nhân
 *   trash/                           file đã xóa mềm, chờ xóa vĩnh viễn
 *     exercise-demos/                giữ nguyên tên folder gốc để khôi phục được
 *     exercise-anatomy/
 *     profile-avatars/
 * </pre>
 *
 * The folders are created by the app when it uploads the first file into them; an admin can also
 * create them by hand in the Cloudinary console.
 */
@Service
public class CloudinaryFolderService {

    /** The root folder of the app; everything the app uploads lives below it. */
    private final String root;

    public CloudinaryFolderService(
            @Value("${app.cloudinary.folder:calishealth}") String root) {
        this.root = root == null || root.isBlank() ? "calishealth" : root.trim().replaceAll("/+$", "");
    }

    /** The root folder of the app, e.g. "calishealth". */
    public String root() {
        return root;
    }

    /** The folder below the root folder, e.g. "calishealth/exercise-demos". */
    public String of(String subFolder) {
        if (subFolder == null || subFolder.isBlank()) return root;
        String clean = subFolder.trim().replaceAll("^/+", "").replaceAll("/+$", "");
        return clean.isEmpty() ? root : root + "/" + clean;
    }

    // ---- The folders of each media type ---------------------------------------------

    /** Video demo của bài tập. */
    public String exerciseDemos() {
        return of("exercise-demos");
    }

    /** Ảnh giải phẫu của bài tập. */
    public String exerciseAnatomy() {
        return of("exercise-anatomy");
    }

    /** Ảnh đại diện của tài khoản. */
    public String profileAvatars() {
        return of("profile-avatars");
    }

    /** Media do thành viên tải lên. */
    public String memberExercises() {
        return of("member-exercises");
    }

    /** File đã xóa mềm, chờ bị xóa vĩnh viễn. */
    public String trash() {
        return of("trash");
    }

    /**
     * The folder a file of the given category belongs to.
     *
     * @param category DEMO_VIDEO | ANATOMY_IMAGE | PROFILE_AVATAR
     */
    public String forCategory(String category) {
        if (MediaFile.ANATOMY_IMAGE.equals(category)) return exerciseAnatomy();
        if (MediaFile.PROFILE_AVATAR.equals(category)) return profileAvatars();
        return exerciseDemos();
    }

    /**
     * The folder a file belongs to, taking the source into account. Media a member uploaded for a
     * personal exercise goes into the member folder, so the admin can tell the community content
     * from the content the Content Manager made.
     *
     * @param category DEMO_VIDEO | ANATOMY_IMAGE | PROFILE_AVATAR
     * @param source   SYSTEM | MEMBER
     */
    public String forCategory(String category, String source) {
        if (MediaFile.SOURCE_MEMBER.equals(source) && !MediaFile.PROFILE_AVATAR.equals(category)) {
            String sub = MediaFile.ANATOMY_IMAGE.equals(category) ? "exercise-anatomy" : "exercise-demos";
            return of("member-exercises/" + sub);
        }
        return forCategory(category);
    }

    /**
     * The folders the app writes into, with the category each one holds. The daily job uses this to
     * list the files of the account and to tell them apart.
     */
    public Map<String, String> foldersByCategory() {
        Map<String, String> folders = new LinkedHashMap<>();
        folders.put(MediaFile.DEMO_VIDEO, exerciseDemos());
        folders.put(MediaFile.ANATOMY_IMAGE, exerciseAnatomy());
        folders.put(MediaFile.PROFILE_AVATAR, profileAvatars());
        folders.put(MediaFile.SOURCE_MEMBER, memberExercises());
        return folders;
    }

    /** The folders that hold the media of the app (not the trash). */
    public Map<String, String> mediaFolders() {
        Map<String, String> folders = new LinkedHashMap<>();
        folders.put(MediaFile.DEMO_VIDEO, exerciseDemos());
        folders.put(MediaFile.ANATOMY_IMAGE, exerciseAnatomy());
        folders.put(MediaFile.PROFILE_AVATAR, profileAvatars());
        return folders;
    }
}
