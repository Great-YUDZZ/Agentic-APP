use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::fmt;
use std::path::Path;

#[repr(C)]
pub struct sqlite3 {
    _private: [u8; 0],
}

#[repr(C)]
pub struct sqlite3_stmt {
    _private: [u8; 0],
}

#[link(name = "sqlite3")]
extern "C" {
    fn sqlite3_open(filename: *const c_char, ppDb: *mut *mut sqlite3) -> c_int;
    fn sqlite3_close(pDb: *mut sqlite3) -> c_int;
    fn sqlite3_errmsg(pDb: *mut sqlite3) -> *const c_char;
    fn sqlite3_exec(
        pDb: *mut sqlite3,
        sql: *const c_char,
        callback: *const c_void,
        arg: *mut c_void,
        errmsg: *mut *mut c_char,
    ) -> c_int;
    fn sqlite3_prepare_v2(
        pDb: *mut sqlite3,
        zSql: *const c_char,
        nByte: c_int,
        ppStmt: *mut *mut sqlite3_stmt,
        pzTail: *mut *const c_char,
    ) -> c_int;
    fn sqlite3_step(pStmt: *mut sqlite3_stmt) -> c_int;
    fn sqlite3_reset(pStmt: *mut sqlite3_stmt) -> c_int;
    fn sqlite3_finalize(pStmt: *mut sqlite3_stmt) -> c_int;
    fn sqlite3_bind_null(pStmt: *mut sqlite3_stmt, i: c_int) -> c_int;
    fn sqlite3_bind_int64(pStmt: *mut sqlite3_stmt, i: c_int, val: i64) -> c_int;
    fn sqlite3_bind_text(
        pStmt: *mut sqlite3_stmt,
        i: c_int,
        text: *const c_char,
        len: c_int,
        destructor: *const c_void,
    ) -> c_int;
    fn sqlite3_column_type(pStmt: *mut sqlite3_stmt, iCol: c_int) -> c_int;
    fn sqlite3_column_int64(pStmt: *mut sqlite3_stmt, iCol: c_int) -> i64;
    fn sqlite3_column_text(pStmt: *mut sqlite3_stmt, iCol: c_int) -> *const c_char;
    fn sqlite3_changes(pDb: *mut sqlite3) -> c_int;
}

const SQLITE_OK: c_int = 0;
const SQLITE_ROW: c_int = 100;
const SQLITE_DONE: c_int = 101;
const SQLITE_NULL: c_int = 5;
const SQLITE_TRANSIENT: *const c_void = -1isize as *const c_void;

#[derive(Debug)]
pub enum Error {
    SqliteFailure(c_int, String),
    InvalidColumnType(usize),
    InvalidColumnIndex(usize),
    NullValue,
    NulError(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::SqliteFailure(code, msg) => write!(f, "SQLite error {}: {}", code, msg),
            Error::InvalidColumnType(idx) => write!(f, "Invalid column type at index {}", idx),
            Error::InvalidColumnIndex(idx) => write!(f, "Invalid column index {}", idx),
            Error::NullValue => write!(f, "Unexpected NULL value"),
            Error::NulError(msg) => write!(f, "CString error: {}", msg),
        }
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;

pub trait ToSql {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()>;
}

impl ToSql for str {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        let c_str = CString::new(self).map_err(|e| Error::NulError(e.to_string()))?;
        let rc = unsafe {
            sqlite3_bind_text(stmt, idx, c_str.as_ptr(), c_str.as_bytes().len() as c_int, SQLITE_TRANSIENT)
        };
        if rc != SQLITE_OK {
            Err(Error::SqliteFailure(rc, "failed to bind text".to_string()))
        } else {
            Ok(())
        }
    }
}

impl ToSql for String {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        self.as_str().bind_to(stmt, idx)
    }
}

impl ToSql for &str {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        (*self).bind_to(stmt, idx)
    }
}

impl ToSql for i64 {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        let rc = unsafe { sqlite3_bind_int64(stmt, idx, *self) };
        if rc != SQLITE_OK {
            Err(Error::SqliteFailure(rc, "failed to bind int64".to_string()))
        } else {
            Ok(())
        }
    }
}

impl ToSql for usize {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        (*self as i64).bind_to(stmt, idx)
    }
}

impl ToSql for bool {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        (if *self { 1i64 } else { 0i64 }).bind_to(stmt, idx)
    }
}

impl<T: ToSql> ToSql for Option<T> {
    fn bind_to(&self, stmt: *mut sqlite3_stmt, idx: c_int) -> Result<()> {
        match self {
            Some(v) => v.bind_to(stmt, idx),
            None => {
                let rc = unsafe { sqlite3_bind_null(stmt, idx) };
                if rc != SQLITE_OK {
                    Err(Error::SqliteFailure(rc, "failed to bind null".to_string()))
                } else {
                    Ok(())
                }
            }
        }
    }
}

pub trait FromSql: Sized {
    fn from_row(stmt: *mut sqlite3_stmt, idx: usize) -> Result<Self>;
}

impl FromSql for String {
    fn from_row(stmt: *mut sqlite3_stmt, idx: usize) -> Result<Self> {
        let col_type = unsafe { sqlite3_column_type(stmt, idx as c_int) };
        if col_type == SQLITE_NULL {
            return Err(Error::NullValue);
        }
        let ptr = unsafe { sqlite3_column_text(stmt, idx as c_int) };
        if ptr.is_null() {
            return Err(Error::NullValue);
        }
        let c_str = unsafe { CStr::from_ptr(ptr) };
        Ok(c_str.to_string_lossy().into_owned())
    }
}

impl FromSql for i64 {
    fn from_row(stmt: *mut sqlite3_stmt, idx: usize) -> Result<Self> {
        let col_type = unsafe { sqlite3_column_type(stmt, idx as c_int) };
        if col_type == SQLITE_NULL {
            return Err(Error::NullValue);
        }
        Ok(unsafe { sqlite3_column_int64(stmt, idx as c_int) })
    }
}

impl FromSql for bool {
    fn from_row(stmt: *mut sqlite3_stmt, idx: usize) -> Result<Self> {
        let val: i64 = FromSql::from_row(stmt, idx)?;
        Ok(val != 0)
    }
}

impl<T: FromSql> FromSql for Option<T> {
    fn from_row(stmt: *mut sqlite3_stmt, idx: usize) -> Result<Self> {
        let col_type = unsafe { sqlite3_column_type(stmt, idx as c_int) };
        if col_type == SQLITE_NULL {
            Ok(None)
        } else {
            T::from_row(stmt, idx).map(Some)
        }
    }
}

pub trait RowIndex {
    fn to_idx(&self) -> usize;
}

impl RowIndex for usize {
    fn to_idx(&self) -> usize {
        *self
    }
}

impl RowIndex for i32 {
    fn to_idx(&self) -> usize {
        *self as usize
    }
}

impl RowIndex for u32 {
    fn to_idx(&self) -> usize {
        *self as usize
    }
}

pub struct Row {
    stmt: *mut sqlite3_stmt,
}

impl Row {
    pub fn get<I: RowIndex, T: FromSql>(&self, idx: I) -> Result<T> {
        FromSql::from_row(self.stmt, idx.to_idx())
    }
}

pub struct Statement {
    stmt: *mut sqlite3_stmt,
    db: *mut sqlite3,
}

impl Statement {
    pub fn query_map<T, F>(&mut self, params: &[&dyn ToSql], mut f: F) -> Result<Vec<Result<T>>>
    where
        F: FnMut(&Row) -> Result<T>,
    {
        unsafe {
            sqlite3_reset(self.stmt);
        }
        for (i, p) in params.iter().enumerate() {
            p.bind_to(self.stmt, (i + 1) as c_int)?;
        }

        let mut results = Vec::new();
        let row = Row { stmt: self.stmt };
        loop {
            let rc = unsafe { sqlite3_step(self.stmt) };
            if rc == SQLITE_ROW {
                results.push(f(&row));
            } else if rc == SQLITE_DONE {
                break;
            } else {
                let err_msg = unsafe {
                    let ptr = sqlite3_errmsg(self.db);
                    if ptr.is_null() {
                        "unknown error".to_string()
                    } else {
                        CStr::from_ptr(ptr).to_string_lossy().into_owned()
                    }
                };
                return Err(Error::SqliteFailure(rc, err_msg));
            }
        }
        Ok(results)
    }
}

impl Drop for Statement {
    fn drop(&mut self) {
        unsafe {
            sqlite3_finalize(self.stmt);
        }
    }
}

pub struct Connection {
    raw: *mut sqlite3,
}

unsafe impl Send for Connection {}
unsafe impl Sync for Connection {}

impl Connection {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_str = path.as_ref().to_str().ok_or_else(|| {
            Error::NulError("Invalid UTF-8 in path".to_string())
        })?;
        let c_path = CString::new(path_str).map_err(|e| Error::NulError(e.to_string()))?;
        let mut raw = std::ptr::null_mut();
        let rc = unsafe { sqlite3_open(c_path.as_ptr(), &mut raw) };
        if rc != SQLITE_OK {
            let msg = if !raw.is_null() {
                let err_ptr = unsafe { sqlite3_errmsg(raw) };
                let msg = unsafe { CStr::from_ptr(err_ptr).to_string_lossy().into_owned() };
                unsafe { sqlite3_close(raw) };
                msg
            } else {
                "failed to allocate db".to_string()
            };
            return Err(Error::SqliteFailure(rc, msg));
        }
        Ok(Self { raw })
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::open(":memory:")
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        let c_sql = CString::new(sql).map_err(|e| Error::NulError(e.to_string()))?;
        let mut err_msg_ptr = std::ptr::null_mut();
        let rc = unsafe {
            sqlite3_exec(
                self.raw,
                c_sql.as_ptr(),
                std::ptr::null(),
                std::ptr::null_mut(),
                &mut err_msg_ptr,
            )
        };
        if rc != SQLITE_OK {
            let msg = if !err_msg_ptr.is_null() {
                let msg = unsafe { CStr::from_ptr(err_msg_ptr).to_string_lossy().into_owned() };
                msg
            } else {
                "exec error".to_string()
            };
            return Err(Error::SqliteFailure(rc, msg));
        }
        Ok(())
    }

    pub fn execute(&self, sql: &str, params: &[&dyn ToSql]) -> Result<usize> {
        let c_sql = CString::new(sql).map_err(|e| Error::NulError(e.to_string()))?;
        let mut stmt = std::ptr::null_mut();
        let rc = unsafe {
            sqlite3_prepare_v2(
                self.raw,
                c_sql.as_ptr(),
                -1,
                &mut stmt,
                std::ptr::null_mut(),
            )
        };
        if rc != SQLITE_OK {
            let msg = unsafe {
                CStr::from_ptr(sqlite3_errmsg(self.raw)).to_string_lossy().into_owned()
            };
            return Err(Error::SqliteFailure(rc, msg));
        }

        for (i, p) in params.iter().enumerate() {
            if let Err(e) = p.bind_to(stmt, (i + 1) as c_int) {
                unsafe { sqlite3_finalize(stmt) };
                return Err(e);
            }
        }

        let step_rc = unsafe { sqlite3_step(stmt) };
        unsafe { sqlite3_finalize(stmt) };

        if step_rc != SQLITE_DONE && step_rc != SQLITE_ROW {
            let msg = unsafe {
                CStr::from_ptr(sqlite3_errmsg(self.raw)).to_string_lossy().into_owned()
            };
            return Err(Error::SqliteFailure(step_rc, msg));
        }

        let changes = unsafe { sqlite3_changes(self.raw) };
        Ok(changes as usize)
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement> {
        let c_sql = CString::new(sql).map_err(|e| Error::NulError(e.to_string()))?;
        let mut stmt = std::ptr::null_mut();
        let rc = unsafe {
            sqlite3_prepare_v2(
                self.raw,
                c_sql.as_ptr(),
                -1,
                &mut stmt,
                std::ptr::null_mut(),
            )
        };
        if rc != SQLITE_OK {
            let msg = unsafe {
                CStr::from_ptr(sqlite3_errmsg(self.raw)).to_string_lossy().into_owned()
            };
            return Err(Error::SqliteFailure(rc, msg));
        }
        Ok(Statement {
            stmt,
            db: self.raw,
        })
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        if !self.raw.is_null() {
            unsafe {
                sqlite3_close(self.raw);
            }
        }
    }
}

#[macro_export]
macro_rules! params {
    () => {
        &[] as &[&dyn $crate::ToSql]
    };
    ($($param:expr),+ $(,)?) => {
        &[$(&$param as &dyn $crate::ToSql),+] as &[&dyn $crate::ToSql]
    };
}
